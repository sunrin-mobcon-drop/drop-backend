import { model, Schema, Document } from 'mongoose';
import moment from 'moment-timezone';
import User from './User';
import Group from './Group';

export interface PostInterface {
  title: string;
  description?: string;
  user: Schema.Types.ObjectId;
  type: string;
  isResolved?: boolean;
  photo?: string;
  time: string;
  place: string;
  reward?: string;
  comment?: {
    user: Schema.Types.ObjectId;
    time: string;
    content: string;
    isImportant: boolean;
  }[];
  group: Schema.Types.ObjectId;
  uploadTime?: string;
}

const PostSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  user: { type: Schema.Types.ObjectId, required: true, ref: User },
  type: { type: String, required: true },
  isResolved: { type: Boolean, default: false },
  photo: {
    type: String,
    default:
      's3://mocon-drop-cdn//bigfiles/KakaoTalk_Image_2020-06-29-07-50-19.jpeg',
  },
  time: { type: String, required: true },
  place: { type: String, required: true },
  reward: { type: String, default: '' },
  comment: [
    {
      user: { type: Schema.Types.ObjectId, required: true, ref: User },
      time: {
        type: String,
        default: () => moment().tz('Asia/Seoul').format('YYYY/MM/DD HH:mm:ss'),
      },
      content: { type: String, required: true },
      isImportant: { type: Boolean, required: true },
    },
  ],
  group: { type: Schema.Types.ObjectId, required: true, ref: Group },
  uploadTime: {
    type: String,
    default: () => moment().tz('Asia/Seoul').format('YYYY/MM/DD HH:mm:ss'),
  },
});

export interface PostDocument extends Document, PostInterface {
  // Add Methods here
}

// PostSchema.methods.~~

// PostSchema.pre('save', function (next: HookNextFunction): void {
//   const doc = this as PostDocument;
//   models.Post.findOne(
//     {
//       $or: [],
//     },
//     function (err: Error, site: PostDocument) {
//       if (site) next(error.db.exists());
//       if (err) next(err);
//       next();
//     },
//   );
// });

const Post = model<PostDocument>('Post', PostSchema);

export default Post;
