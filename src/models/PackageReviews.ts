import { Schema, model, models, type Document } from 'mongoose'

export interface IPackageReview extends Document {
  packageId: string;
  userId: string;
  review: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

const packageReviewSchema = new Schema<IPackageReview>(
  {
    packageId: { type: String, required: true, trim: true },
    userId: { type: String, required: true, trim: true },
    review: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  {
    timestamps: true,
  }
)

const PackageReview = models.PackageReview || model<IPackageReview>('PackageReview', packageReviewSchema)

export default PackageReview;
