/**
 * Unit tests — EventChainingService
 *
 * Mô phỏng toàn bộ vòng state machine mà không cần DB thật:
 *
 *  MONITOR ──(humidity<20 & light>500)──► WATERING ──(5p)──► RECOVER ──(2p)──► MONITOR
 *
 * Cases được test:
 *  1. MONITOR → MONITOR        : điều kiện chưa đạt ngưỡng
 *  2. MONITOR → WATERING       : humidity<20 AND light>500
 *  3. WATERING → WATERING      : timer chưa hết → giữ nguyên
 *  4. WATERING → RECOVER       : sensor push sau khi timer hết 5p
 *  5. confirmWatering          : WATERING→RECOVER hợp lệ (sau 5p)
 *  6. confirmWatering sớm      : reject khi chưa đủ 5p
 *  7. confirmWatering sai state: trả no-op khi không phải WATERING
 *  8. RECOVER → RECOVER        : timer chưa hết 2p
 *  9. RECOVER → MONITOR        : timer hết 2p
 * 10. Device mới               : auto-create state MONITOR
 * 11. getDeviceState           : snapshot khi device chưa tồn tại
 * 12. getDeviceState           : snapshot khi đang WATERING
 * 13. getEventLogs             : query filter + sort/limit
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventChainingService } from './event-chaining.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { EventChainingGateway } from './event-chaining.gateway';
import { ChainState, DeviceState } from '../../schemas/device-state.schema';
import { EventLog } from '../../schemas/event-log.schema';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Tạo mock Mongoose document cho DeviceState */
function makeStateDoc(overrides: Record<string, unknown> = {}): any {
  const doc: Record<string, unknown> = {
    deviceId: 'device_01',
    state: ChainState.MONITOR,
    stateStartedAt: new Date(),
    wateringEndsAt: undefined,
    recoverEndsAt: undefined,
    updatedAt: new Date(),
    ...overrides,
  };
  // save() mock: cập nhật doc tại chỗ rồi trả về chính nó
  doc['save'] = jest.fn().mockImplementation(() => Promise.resolve(doc));
  return doc;
}

/** Tạo mock EventLog document */
function makeLogDoc(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => 'log_id_mock' },
    state: ChainState.MONITOR,
    action: 'none',
    timestamp: new Date(),
    ...overrides,
  };
}

// ─── suite ──────────────────────────────────────────────────────────────────

describe('EventChainingService', () => {
  let service: EventChainingService;
  let deviceStateModel: { findOne: jest.Mock; create: jest.Mock };
  let eventLogModel: { create: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let gateway: { publishState: jest.Mock };
  let eventBus: { emit: jest.Mock; on: jest.Mock };

  beforeEach(async () => {
    deviceStateModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };

    eventLogModel = {
      create: jest.fn().mockResolvedValue(makeLogDoc()),
      findOne: jest
        .fn()
        .mockReturnValue({ sort: jest.fn().mockResolvedValue(null) }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    };

    gateway = { publishState: jest.fn() };

    eventBus = {
      emit: jest.fn(),
      on: jest.fn().mockReturnValue(() => {}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventChainingService,
        {
          provide: getModelToken(DeviceState.name),
          useValue: deviceStateModel,
        },
        {
          provide: getModelToken(EventLog.name),
          useValue: eventLogModel,
        },
        { provide: EventBusService, useValue: eventBus },
        {
          provide: SystemLogsService,
          useValue: { appendEvent: jest.fn() },
        },
        { provide: EventChainingGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(EventChainingService);
  });

  // ── 1. MONITOR → MONITOR ──────────────────────────────────────────────────
  describe('1. MONITOR → MONITOR (điều kiện chưa đạt ngưỡng)', () => {
    it('humidity đủ cao → action=none, state giữ MONITOR', async () => {
      const stateDoc = makeStateDoc({ state: ChainState.MONITOR });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);
      eventLogModel.create.mockResolvedValue(
        makeLogDoc({ state: ChainState.MONITOR, action: 'none' }),
      );

      const res = await service.processSensorData({
        deviceId: 'device_01',
        humidity: 50, // ≥ 20 → không trigger
        light: 600,
      });

      expect(res.state).toBe(ChainState.MONITOR);
      expect(res.action).toBe('none');
      // Không chuyển state → save() không được gọi
      expect(stateDoc['save']).not.toHaveBeenCalled();
      // Gateway vẫn được notify với MONITOR
      expect(gateway.publishState).toHaveBeenCalledWith(
        expect.objectContaining({ state: ChainState.MONITOR, action: 'none' }),
      );
    });

    it('ánh sáng yếu dưới ngưỡng → không kích hoạt tưới', async () => {
      const stateDoc = makeStateDoc({ state: ChainState.MONITOR });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);

      const res = await service.processSensorData({
        deviceId: 'device_01',
        humidity: 10, // < 20 đủ điều kiện ẩm
        light: 400, // ≤ 500 → ánh sáng yếu, KHÔNG đạt ngưỡng
      });

      expect(res.state).toBe(ChainState.MONITOR);
      expect(res.action).toBe('none');
    });
  });

  // ── 2. MONITOR → WATERING ─────────────────────────────────────────────────
  describe('2. MONITOR → WATERING (đạt ngưỡng kích hoạt)', () => {
    it('humidity<20 AND light>500 → state=WATERING, action=start_pump', async () => {
      const stateDoc = makeStateDoc({ state: ChainState.MONITOR });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);
      eventLogModel.create.mockResolvedValue(
        makeLogDoc({ state: ChainState.WATERING, action: 'start_pump' }),
      );

      const res = await service.processSensorData({
        deviceId: 'device_01',
        humidity: 15, // < 20 ✓
        light: 600, // > 500 ✓
      });

      expect(res.state).toBe(ChainState.WATERING);
      expect(res.action).toBe('start_pump');
      expect(res.duration).toBe(300); // 5 phút

      // State document phải được cập nhật và lưu
      expect(stateDoc['state']).toBe(ChainState.WATERING);
      expect(stateDoc['wateringEndsAt']).toBeInstanceOf(Date);
      expect((stateDoc['wateringEndsAt'] as Date).getTime()).toBeGreaterThan(
        Date.now() + 290_000,
      );
      expect(stateDoc['save']).toHaveBeenCalledTimes(1);

      // Phát sự kiện điều khiển actuator
      expect(eventBus.emit).toHaveBeenCalledWith(
        'ACTUATOR_COMMAND_ISSUED',
        expect.objectContaining({
          data: expect.objectContaining({ command: 'start_pump' }),
        }),
      );
      // WebSocket notify FE
      expect(gateway.publishState).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'start_pump',
          state: ChainState.WATERING,
        }),
      );
    });
  });

  // ── 3. WATERING → WATERING (timer chưa hết) ───────────────────────────────
  describe('3. WATERING → WATERING (đang tưới, timer còn chạy)', () => {
    it('tiếp tục WATERING khi wateringEndsAt chưa qua', async () => {
      const wateringEndsAt = new Date(Date.now() + 200_000); // còn 200s
      const stateDoc = makeStateDoc({
        state: ChainState.WATERING,
        stateStartedAt: new Date(Date.now() - 100_000),
        wateringEndsAt,
      });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);

      const res = await service.processSensorData({
        deviceId: 'device_01',
        humidity: 8,
        light: 700,
      });

      expect(res.state).toBe(ChainState.WATERING);
      expect(res.action).toBe('none');
      expect(res.duration).toBeGreaterThan(190); // ~200s còn lại

      // State không đổi → save() không được gọi
      expect(stateDoc['save']).not.toHaveBeenCalled();
    });
  });

  // ── 4. WATERING → RECOVER (timer hết, qua sensor-data) ────────────────────
  describe('4. WATERING → RECOVER (timer 5p hết, sensor push tiếp theo)', () => {
    it('phát stop_pump và chuyển sang RECOVER', async () => {
      const wateringEndsAt = new Date(Date.now() - 1_000); // hết hạn 1s rồi
      const stateDoc = makeStateDoc({
        state: ChainState.WATERING,
        stateStartedAt: new Date(Date.now() - 301_000),
        wateringEndsAt,
      });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);
      eventLogModel.create.mockResolvedValue(
        makeLogDoc({ state: ChainState.RECOVER, action: 'stop_pump' }),
      );

      const res = await service.processSensorData({
        deviceId: 'device_01',
        humidity: 8,
        light: 700,
      });

      expect(res.state).toBe(ChainState.RECOVER);
      expect(res.action).toBe('stop_pump');
      expect(res.duration).toBe(120); // 2 phút recover

      // recoverEndsAt phải được set
      expect(stateDoc['recoverEndsAt']).toBeInstanceOf(Date);
      expect(stateDoc['save']).toHaveBeenCalledTimes(1);

      // Actuator confirm
      expect(eventBus.emit).toHaveBeenCalledWith(
        'ACTUATOR_COMMAND_CONFIRMED',
        expect.objectContaining({
          data: expect.objectContaining({ command: 'stop_pump' }),
        }),
      );
      expect(gateway.publishState).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'stop_pump',
          state: ChainState.RECOVER,
        }),
      );
    });
  });

  // ── 5. confirmWatering: WATERING → RECOVER (hợp lệ) ─────────────────────
  describe('5. confirmWatering — WATERING → RECOVER (sau 5p, device xác nhận)', () => {
    it('cho phép chuyển RECOVER nếu timer đã hết', async () => {
      const wateringEndsAt = new Date(Date.now() - 1_000); // đã hết
      const stateDoc = makeStateDoc({
        state: ChainState.WATERING,
        stateStartedAt: new Date(Date.now() - 301_000),
        wateringEndsAt,
      });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);
      eventLogModel.create.mockResolvedValue(
        makeLogDoc({ state: ChainState.RECOVER, action: 'stop_pump' }),
      );

      const res = await service.confirmWatering({
        deviceId: 'device_01',
        state: 'WATERING done',
      });

      expect(res.state).toBe(ChainState.RECOVER);
      expect(res.action).toBe('stop_pump');
      expect(stateDoc['save']).toHaveBeenCalledTimes(1);
    });
  });

  // ── 6. confirmWatering sớm quá (chưa đủ 5p) ─────────────────────────────
  describe('6. confirmWatering — reject khi chưa đủ 5 phút', () => {
    it('giữ nguyên WATERING, trả remainingSeconds', async () => {
      const wateringEndsAt = new Date(Date.now() + 100_000); // còn 100s
      const stateDoc = makeStateDoc({
        state: ChainState.WATERING,
        stateStartedAt: new Date(Date.now() - 200_000),
        wateringEndsAt,
      });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);

      const res = await service.confirmWatering({ deviceId: 'device_01' });

      expect(res.state).toBe(ChainState.WATERING);
      expect(res.action).toBe('none');
      expect(res.duration).toBeGreaterThan(90);
      // Không thay đổi state
      expect(stateDoc['save']).not.toHaveBeenCalled();
    });
  });

  // ── 7. confirmWatering khi không phải WATERING ────────────────────────────
  describe('7. confirmWatering — no-op khi sai state', () => {
    it('trả nguyên state hiện tại nếu không phải WATERING', async () => {
      const stateDoc = makeStateDoc({ state: ChainState.MONITOR });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);

      const res = await service.confirmWatering({ deviceId: 'device_01' });

      expect(res.state).toBe(ChainState.MONITOR);
      expect(res.action).toBe('none');
      expect(stateDoc['save']).not.toHaveBeenCalled();
    });
  });

  // ── 8. RECOVER → RECOVER (chưa đủ 2p) ────────────────────────────────────
  describe('8. RECOVER → RECOVER (sensor ổn định đang chờ)', () => {
    it('ở lại RECOVER khi recoverEndsAt chưa qua', async () => {
      const recoverEndsAt = new Date(Date.now() + 60_000); // còn 60s
      const stateDoc = makeStateDoc({
        state: ChainState.RECOVER,
        stateStartedAt: new Date(Date.now() - 60_000),
        recoverEndsAt,
      });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);

      const res = await service.processSensorData({
        deviceId: 'device_01',
        humidity: 10,
        light: 700,
      });

      expect(res.state).toBe(ChainState.RECOVER);
      expect(res.action).toBe('none');
      expect(res.duration).toBeGreaterThan(55);
      expect(stateDoc['save']).not.toHaveBeenCalled();
    });
  });

  // ── 9. RECOVER → MONITOR (xong 2p) ───────────────────────────────────────
  describe('9. RECOVER → MONITOR (sensor ổn định xong, quay lại giám sát)', () => {
    it('chuyển về MONITOR sau khi recover timeout', async () => {
      const recoverEndsAt = new Date(Date.now() - 1_000); // đã hết
      const stateDoc = makeStateDoc({
        state: ChainState.RECOVER,
        stateStartedAt: new Date(Date.now() - 121_000),
        recoverEndsAt,
      });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);
      eventLogModel.create.mockResolvedValue(
        makeLogDoc({ state: ChainState.MONITOR, action: 'none' }),
      );

      const res = await service.processSensorData({
        deviceId: 'device_01',
        humidity: 10,
        light: 700,
      });

      expect(res.state).toBe(ChainState.MONITOR);
      expect(res.action).toBe('none');
      expect(res.duration).toBe(0);
      expect(stateDoc['save']).toHaveBeenCalledTimes(1);
      // Không còn wateringEndsAt / recoverEndsAt
      expect(stateDoc['wateringEndsAt']).toBeUndefined();
      expect(stateDoc['recoverEndsAt']).toBeUndefined();

      expect(gateway.publishState).toHaveBeenCalledWith(
        expect.objectContaining({ state: ChainState.MONITOR }),
      );
    });
  });

  // ── 10. Device mới (tự khởi tạo state) ───────────────────────────────────
  describe('10. Device mới — tự khởi tạo MONITOR', () => {
    it('gọi deviceStateModel.create với state=MONITOR khi device chưa có record', async () => {
      const createdDoc = makeStateDoc({
        deviceId: 'new_device',
        state: ChainState.MONITOR,
      });
      deviceStateModel.findOne.mockResolvedValue(null); // chưa tồn tại
      deviceStateModel.create.mockResolvedValue(createdDoc);
      eventLogModel.create.mockResolvedValue(
        makeLogDoc({ state: ChainState.MONITOR, action: 'none' }),
      );

      const res = await service.processSensorData({
        deviceId: 'new_device',
        humidity: 60,
        light: 200,
      });

      expect(deviceStateModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'new_device',
          state: ChainState.MONITOR,
        }),
      );
      expect(res.state).toBe(ChainState.MONITOR);
    });
  });

  // ── 11. getDeviceState — device chưa tồn tại ─────────────────────────────
  describe('11. getDeviceState — device chưa tồn tại', () => {
    it('trả exists:false và default MONITOR', async () => {
      deviceStateModel.findOne.mockResolvedValue(null);
      eventLogModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      const res = await service.getDeviceState('unknown');

      expect(res.exists).toBe(false);
      expect(res.state).toBe(ChainState.MONITOR);
      expect(res.remainingSeconds).toBe(0);
      expect(res.latestEvent).toBeNull();
    });
  });

  // ── 12. getDeviceState — device đang WATERING ─────────────────────────────
  describe('12. getDeviceState — đang WATERING', () => {
    it('trả state=WATERING, remainingSeconds>0, latestEvent chứa start_pump', async () => {
      const wateringEndsAt = new Date(Date.now() + 200_000);
      const stateDoc = makeStateDoc({
        deviceId: 'device_01',
        state: ChainState.WATERING,
        stateStartedAt: new Date(Date.now() - 100_000),
        wateringEndsAt,
      });
      deviceStateModel.findOne.mockResolvedValue(stateDoc);
      eventLogModel.findOne.mockReturnValue({
        sort: jest
          .fn()
          .mockResolvedValue(
            makeLogDoc({ state: ChainState.WATERING, action: 'start_pump' }),
          ),
      });

      const res = await service.getDeviceState('device_01');

      expect(res.exists).toBe(true);
      expect(res.state).toBe(ChainState.WATERING);
      expect(res.remainingSeconds).toBeGreaterThan(190);
      expect(res.wateringEndsAt).toBeTruthy();
      expect(res.latestEvent?.action).toBe('start_pump');
    });
  });

  // ── 13. getEventLogs — query/filter lịch sử ───────────────────────────────
  describe('13. getEventLogs — lấy lịch sử event_logs cho FE', () => {
    it('apply filter + sort desc theo timestamp + limit', async () => {
      const exec = jest.fn().mockResolvedValue([makeLogDoc()]);
      const lean = jest.fn().mockReturnValue({ exec });
      const limit = jest.fn().mockReturnValue({ lean });
      const sort = jest.fn().mockReturnValue({ limit });
      eventLogModel.find.mockReturnValue({ sort });

      const res = await service.getEventLogs({
        deviceId: 'node_01',
        state: ChainState.WATERING,
        action: 'start_pump',
        from: '2026-03-14T10:00:00.000Z',
        to: '2026-03-14T11:00:00.000Z',
        limit: 50,
      });

      expect(eventLogModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'node_01',
          state: ChainState.WATERING,
          action: 'start_pump',
          timestamp: {
            $gte: new Date('2026-03-14T10:00:00.000Z'),
            $lte: new Date('2026-03-14T11:00:00.000Z'),
          },
        }),
      );
      expect(sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(limit).toHaveBeenCalledWith(50);
      expect(res).toHaveLength(1);
    });
  });
});
