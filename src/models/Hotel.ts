import { Schema, model, models, type Document } from 'mongoose'

export interface IHotel extends Document {
  name: string;
  phoneNumber: string;
  address: string;
  photos?: string[];
  budget: number;
  createdAt: Date;
  updatedAt: Date;
}

const hotelSchema = new Schema<IHotel>(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    photos: { type: [String], required: true, default: [] },
    budget: { type: Number, required: true, trim: true },
  },
  {
    timestamps: true,
  }
)

const Hotel = models.Hotel || model<IHotel>('Hotel', hotelSchema)

export default Hotel;
