import { Schema, model, models, type Document } from 'mongoose'

export type PackageStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected'

export interface IPackageDraftHotel {
  name?: string;
  phoneNumber?: string;
  address?: string;
  photos?: string[];
  budget?: number;
}

export interface IPackageDraftVehicle {
  car?: string;
  carNumber?: string;
  driverName?: string;
  driverPhoneNumber?: string;
  vehicleType?: string;
  budget?: number;
}

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
  approved: boolean;
  status: PackageStatus;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  draftHotels?: IPackageDraftHotel[];
  draftVehicles?: IPackageDraftVehicle[];
  createdAt: Date;
  updatedAt: Date;
}

const draftHotelSchema = new Schema<IPackageDraftHotel>(
  {
    name: { type: String, trim: true, default: '' },
    phoneNumber: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    photos: { type: [String], default: [] },
    budget: { type: Number, min: 0 },
  },
  { _id: false }
)

const draftVehicleSchema = new Schema<IPackageDraftVehicle>(
  {
    car: { type: String, trim: true, default: '' },
    carNumber: { type: String, trim: true, default: '' },
    driverName: { type: String, trim: true, default: '' },
    driverPhoneNumber: { type: String, trim: true, default: '' },
    vehicleType: { type: String, trim: true, default: '' },
    budget: { type: Number, min: 0 },
  },
  { _id: false }
)

const packageSchema = new Schema<IPackage> (
  {
    name: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    coverImage: { type: String, trim: true, default: '' },
    season: { type: String, trim: true, default: '' },
    budget: { type: Number, min: 0, default: 0 },
    destination: { type: String, trim: true, default: '' },
    spots: { type: [String], default: [] },
    duration: { type: Number, min: 0, default: 0 },
    startDate: { type: String, trim: true, default: '' },
    endDate: { type: String, trim: true, default: '' },
    identification: { type: Boolean, required: true, default: false },
    permit: { type: String, trim: true, default: '' },
    tags: { type: [String], default: [] },
    affiliateLinks: { type: [String], default: [] },
    createdBy: { type: String, required: true, trim: true },
    additional: { type: String, trim: true },
    hotels: [{ type: Schema.Types.ObjectId, ref: 'Hotel', default: [] }],
    vehicles: [{ type: Schema.Types.ObjectId, ref: 'Vehicle', default: [] }], 
    approved: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'rejected'],
      required: true,
      default: 'draft',
      index: true,
    },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    draftHotels: { type: [draftHotelSchema], default: [] },
    draftVehicles: { type: [draftVehicleSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

const Package = models.Package || model<IPackage>('Package', packageSchema)

export default Package;
