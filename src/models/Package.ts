import { Schema, model, models, type Document } from 'mongoose'

export interface IPackage extends Document {
  name: string;
  description: string;
  coverImage: string;
  season: string;
  budget: number;
  destination: string;
  spots: string[];
  duration: number;
  startDate: string;
  endDate: string;
  identification: boolean;
  permit: string;
  hotels: Schema.Types.ObjectId[];
  vehicles: Schema.Types.ObjectId[];
  tags?: string[];
  affiliateLinks?: string[];
  additional?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const packageSchema = new Schema<IPackage> (
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    coverImage: { type: String, required: true, trim: true },
    season: { type: String, required: true, trim: true },
    budget: { type: Number, required: true, min: 0 },
    destination: { type: String, required: true, trim: true },
    spots: { type: [String], required: true, default: [] },
    duration: { type: Number, required: true, min: 1 },
    startDate: { type: String, required: true, trim: true },
    endDate: { type: String, required: true, trim: true },
    identification: { type: Boolean, required: true, default: false },
    permit: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
    affiliateLinks: { type: [String], default: [] },
    createdBy: { type: String, required: true, trim: true },
    additional: { type: String, trim: true },
    hotels: [{ type: Schema.Types.ObjectId, ref: 'Hotel', default: [] }],
    vehicles: [{ type: Schema.Types.ObjectId, ref: 'Vehicle', default: [] }],
  },
  {
    timestamps: true,
  }
);

const Package = models.Package || model<IPackage>('Package', packageSchema)

export default Package;
