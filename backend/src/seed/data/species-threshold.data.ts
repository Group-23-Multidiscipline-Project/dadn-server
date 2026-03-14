/**
 * Species threshold seed data
 *
 * Soil moisture  : % volumetric water content (VWC) of field capacity
 * Light (lux)    : photosynthetically active radiation proxy (lux)
 *
 * References:
 *  [1] FAO Irrigation and Drainage Paper No. 56 – "Crop evapotranspiration"
 *      (Allen et al., 1998) — crop water stress thresholds.
 *  [2] Sonneveld & Voogt, "Plant Nutrition of Greenhouse Crops" (Springer, 2009)
 *      — EC/moisture recommendations per species.
 *  [3] Runkle & Both, "Greenhouse & Nursery Management" — DLI / lux guidelines
 *      for vegetable & herb crops.
 *  [4] Goto, E. (2012). "Plant production in a closed plant factory with
 *      artificial lighting." Acta Horticulturae 956 — light intensity tables.
 *
 * Values are typical ranges for soil-based or substrate cultivation in a
 * tropical-greenhouse context (Vietnam climate zone).
 */

export interface ThresholdRange {
  lb: number;
  ub: number;
}

export interface SpeciesThresholdSeedItem {
  speciesName: string;
  thresholds: {
    soilMoisture: ThresholdRange; // ADC raw 0-4095 (inverted: high=dry)
    light: ThresholdRange; // ADC raw 0-4095 (direct:  high=bright)
  };
}

/**
 * Soil moisture calibration (capacitive sensor, inverted ADC):
 *   ~3800 = air / bone-dry    ~1000 = fully saturated
 *   ADC ≈ 3800 − (VWC% / 100) × 2800
 *   lb = wetter boundary (lower ADC),  ub = drier boundary (higher ADC)
 *   → Irrigate when ADC > ub   → Optimal when lb ≤ ADC ≤ ub
 *
 * Light calibration (LDR voltage-divider, direct ADC):
 *   ADC ≈ lux / 20  (rough estimate — recalibrate per sensor)
 *   lb = min acceptable brightness → grow light ON when ADC < lb
 */
export const speciesThresholdSeedData: SpeciesThresholdSeedItem[] = [
  {
    // Cà chua — 60–80% VWC → ADC 1500–2100  |  20k–70k lux → ADC 1000–3500
    // Ref [1] p.163, [3] ch.8
    speciesName: 'Tomato',
    thresholds: {
      soilMoisture: { lb: 1500, ub: 2100 },
      light: { lb: 1000, ub: 3500 },
    },
  },
  {
    // Ớt chuông — 55–75% VWC → ADC 1700–2300  |  20k–60k lux → ADC 1000–3000
    // Ref [1] p.168, [2] ch.12
    speciesName: 'BellPepper',
    thresholds: {
      soilMoisture: { lb: 1700, ub: 2300 },
      light: { lb: 1000, ub: 3000 },
    },
  },
  {
    // Dưa leo — 65–80% VWC → ADC 1500–2000  |  25k–65k lux → ADC 1200–3200
    // Ref [1] p.165, [3] ch.9
    speciesName: 'Cucumber',
    thresholds: {
      soilMoisture: { lb: 1500, ub: 2000 },
      light: { lb: 1200, ub: 3200 },
    },
  },
  {
    // Xà lách — 60–75% VWC → ADC 1700–2100  |  5k–30k lux → ADC 250–1500
    // Shade-tolerant; Ref [4] Table 2, [3] ch.14
    speciesName: 'Lettuce',
    thresholds: {
      soilMoisture: { lb: 1700, ub: 2100 },
      light: { lb: 250, ub: 1500 },
    },
  },
  {
    // Dâu tây — 60–75% VWC → ADC 1700–2100  |  20k–50k lux → ADC 1000–2500
    // Ref [1] p.176
    speciesName: 'Strawberry',
    thresholds: {
      soilMoisture: { lb: 1700, ub: 2100 },
      light: { lb: 1000, ub: 2500 },
    },
  },
  {
    // Húng quế — 50–65% VWC → ADC 2000–2400  |  15k–40k lux → ADC 750–2000
    // Ref [3] ch.18
    speciesName: 'Basil',
    thresholds: {
      soilMoisture: { lb: 2000, ub: 2400 },
      light: { lb: 750, ub: 2000 },
    },
  },
  {
    // Cải bó xôi — 60–75% VWC → ADC 1700–2100  |  8k–35k lux → ADC 400–1750
    // Cool-season, low-light tolerant; Ref [4] Table 3
    speciesName: 'Spinach',
    thresholds: {
      soilMoisture: { lb: 1700, ub: 2100 },
      light: { lb: 400, ub: 1750 },
    },
  },
  {
    // Cải xanh / pak choi — 55–70% VWC → ADC 1800–2300  |  10k–40k lux → ADC 500–2000
    speciesName: 'PakChoi',
    thresholds: {
      soilMoisture: { lb: 1800, ub: 2300 },
      light: { lb: 500, ub: 2000 },
    },
  },
];
