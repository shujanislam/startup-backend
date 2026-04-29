import { Schema, model, models, type Document } from 'mongoose'

export interface IUserPackageReveal extends Document {
  packageId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const userPackageRevealSchema = new Schema<IUserPackageReveal>(
  {
    packageId: { type: String, required: true, trim: true },
    userId: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  }
)

const UserPacakgeReveal = models.UserPacakgeReveal || model<IUserPackageReveal>('UserPacakgeReveal', userPackageRevealSchema)

export default UserPacakgeReveal;
