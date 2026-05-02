import { Schema, model, models, type Document } from 'mongoose'

export interface ILikedPackage extends Document {
  packageId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const likedPackageSchema = new Schema<ILikedPackage>(
  {
    packageId: { type: String, required: true, trim: true },
    userId: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  }
)

likedPackageSchema.index({ packageId: 1, userId: 1 }, { unique: true })

const LikedPackage = models.LikedPackage || model<ILikedPackage>('LikedPackage', likedPackageSchema)

export default LikedPackage;
