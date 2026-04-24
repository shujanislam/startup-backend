import { Schema, model, models, type Document } from 'mongoose'

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  profilePicture?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: '' },
    bio: { type: String, trim: true}
  },
  {
    timestamps: true,
  }
)

const User = models.User || model<IUser>('User', userSchema)

export default User;