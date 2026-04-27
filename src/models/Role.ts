import { Schema, model, models, type Document } from 'mongoose'

export interface IRole extends Document {
  name: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, trim: true },
    permissions: { type: [String], required: true, trim: true },
    createdBy: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  }
)

const Role = models.Role || model<IRole>('Role', roleSchema)

export default roleSchema;
