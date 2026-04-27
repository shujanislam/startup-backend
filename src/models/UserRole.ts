import { Schema, model, models, type Document } from 'mongoose'

export interface IUserRole extends Document {
  userId: string;
  roleId: string;
  metadata?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const userRoleSchema = new Schema<IUserRole>(
  {
    userId: { type: String, required: true, trim: true },
    roleId: { type: String, required: true, trim: true },
    metadata: { type: [String], required: false, trim: true },
    createdBy: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  }
)

const UserRole = models.UserRole || model<IUserRole>('UserRole', userRoleSchema)

export default userRoleSchema;
