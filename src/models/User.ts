import { Schema, model, models, type Document } from 'mongoose'

export interface IUser extends Document {
  firebaseId: string;
  name: string;
  email: string;
  password: string;
  profilePicture?: string;
  bio?: string;
  gender: string;
  onboardingComplete?: boolean;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    firebaseId: { type: String, required: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    gender: { type: String, required: true },
    profilePicture: { type: String, default: '' },
    bio: { type: String, trim: true},
    onboardingComplete: { type: Boolean, required: false },
    tags: { type: [String], default: [] }
  },
  {
    timestamps: true,
  }
)

const User = models.User || model<IUser>('User', userSchema)

export default User;
