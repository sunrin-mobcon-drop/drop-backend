import { model, Schema, Document, HookNextFunction, models } from 'mongoose';
import error from '@error';
import Group from './Group';

export interface UserInterface {
  userid: string;
  name: string;
  password: string;
  enckey: string;
  authority?: string;
  group?: Schema.Types.ObjectId[];
  photo?: string;
  fcmtoken: string;
  keyword: string[];
}

const UserSchema = new Schema<UserDocument>({
  userid: { type: String, required: true, lowercase: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  enckey: { type: String, required: true },
  authority: { type: String, default: 'normal' },
  group: { type: [String], default: [], ref: 'Group' },
  photo: {
    type: String,
    default:
      's3://mocon-drop-cdn//bigfiles/KakaoTalk_Image_2020-06-29-07-50-19.jpeg',
  },
  fcmtoken: { type: String, required: true },
  keyword: { type: [String], default: [] },
});

export interface UserDocument extends Document, UserInterface {
  checkUserExists(userid: string): Promise<boolean>;
}

UserSchema.methods.checkUserExists = async function (userid): Promise<boolean> {
  if (await models.User.findOne({ userid }).exec()) return true;
  return false;
};

UserSchema.pre('save', function (next: HookNextFunction) {
  const doc = this as UserDocument;
  models.User.findOne({ userid: doc.userid }, function (err, user) {
    if (user) next(error.db.exists() as any);
    if (err) next(err);
    next();
  });
});

const User = model<UserDocument>('User', UserSchema);

export default User;
