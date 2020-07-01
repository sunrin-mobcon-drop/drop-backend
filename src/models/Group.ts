import { model, Schema, Document, HookNextFunction, models } from 'mongoose';
import error from '@error';
import User from './User';

export interface GroupInterface {
  name: string;
  description?: string;
  photo?: string;
  creator: Schema.Types.ObjectId;
}

const GroupSchema: Schema = new Schema({
  name: { type: String, required: true },
  photo: {
    type: String,
    default:
      's3://mocon-drop-cdn//bigfiles/KakaoTalk_Image_2020-06-29-07-50-19.jpeg',
  },
  description: { type: String, default: '' },
  creator: { type: Schema.Types.ObjectId, required: true, ref: User },
});

export interface GroupDocument extends Document, GroupInterface {
  // Add Methods here
}

// GroupSchema.methods.~~

GroupSchema.pre('save', function (next: HookNextFunction): void {
  const doc = this as GroupDocument;
  models.Group.findOne(
    {
      $or: [{ name: doc.name }],
    },
    function (err: Error, site: GroupDocument) {
      if (site) next(error.db.exists());
      if (err) next(err);
      next();
    },
  );
});

const Group = model<GroupDocument>('Group', GroupSchema);

export default Group;
