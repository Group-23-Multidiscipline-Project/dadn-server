import mongoose from 'mongoose';
import 'dotenv/config';
import { speciesThresholdSeedData } from './data/species-threshold.data';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/yolofarm';

const ThresholdRangeSchema = new mongoose.Schema(
  { lb: Number, ub: Number },
  { _id: false },
);

const SpeciesThresholdSchema = new mongoose.Schema(
  {
    speciesName: { type: String, required: true, unique: true },
    thresholds: {
      soilMoisture: { type: ThresholdRangeSchema, required: true },
      light: { type: ThresholdRangeSchema, required: true },
    },
  },
  { collection: 'species_thresholds', timestamps: true },
);

const SpeciesThresholdModel = mongoose.model(
  'SpeciesThreshold',
  SpeciesThresholdSchema,
  'species_thresholds',
);

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: 'yolofarm' });
  console.log('Connected to MongoDB:', MONGO_URI);

  let inserted = 0;
  let skipped = 0;

  for (const item of speciesThresholdSeedData) {
    const existing = await SpeciesThresholdModel.findOne({
      speciesName: item.speciesName,
    });

    if (existing) {
      console.log(`  [skip]   ${item.speciesName}: already exists`);
      skipped++;
    } else {
      await SpeciesThresholdModel.create(item);
      console.log(`  [insert] ${item.speciesName}`);
      inserted++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
