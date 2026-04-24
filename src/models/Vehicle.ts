import { Schema, model, models, type Document } from 'mongoose'

export interface IVehicle extends Document {
  car: string;
  carNumber: string;
  driverName?: string;
  driverPhoneNumber: string;
  vehicleType: string;
  budget: number;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<IVehicle>(
  {
    car: { type: String, required: true, trim: true },
    carNumber: { type: String, required: true, trim: true },
    driverName: { type: String, required: false, trim: true },
    vehicleType: { type: String, required: false, trim: true },
    budget: { type: Number, required: true, trim: true },
    driverPhoneNumber: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  }
)

const Vehicle = models.Vehicle || model<IVehicle>('Vehicle', vehicleSchema)

export default Vehicle;
