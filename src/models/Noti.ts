import { model, Schema, Document } from 'mongoose';
import User from './User';
import Post from './Post';
import moment from 'moment-timezone';

export interface NotiInterface {
  // Add Schema here
  targetUser: [Schema.Types.ObjectId];
  post: Schema.Types.ObjectId;
  title: string;
  content: string;
  time?: string;
}

const NotiSchema: Schema = new Schema({
  targetUser: { type: [Schema.Types.ObjectId], required: true, ref: User },
  post: { type: Schema.Types.ObjectId, required: true, ref: Post },
  title: { type: String, required: true },
  content: { type: String, required: true },
  time: {
    type: String,
    default: () => moment().tz('Asia/Seoul').format('YYYY/MM/DD HH:mm:ss'),
  },
});

export interface NotiDocument extends Document, NotiInterface {
  // Add Methods here
}

// NotiSchema.methods.~~

// NotiSchema.pre('save', function (next: HookNextFunction): void {
//   const doc = this as NotiDocument;
//   models.Noti.findOne(
//     {
//       $or: [],
//     },
//     function (err: Error, site: NotiDocument) {
//       if (site) next(error.db.exists());
//       if (err) next(err);
//       next();
//     },
//   );
// });

const Noti = model<NotiDocument>('Noti', NotiSchema);

export default Noti;
