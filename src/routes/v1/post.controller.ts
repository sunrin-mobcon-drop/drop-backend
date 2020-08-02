import Controller from '@lib/blueprint/Controller';
import Assets from '@util/Assets';
import Aws from '@util/Aws';
import moment from 'moment';
import firebase from 'firebase-admin';
import firebaseCredentials from '../../../firebase.json';
import mongoose, { Schema } from 'mongoose';
import { UploadedFile } from 'express-fileupload';

firebase.initializeApp({
  credential: firebase.credential.cert(firebaseCredentials as any),
});

export default new (class extends Controller {
  constructor() {
    super();
    this.router.get('/', this.auth.authority.user, this.getPostMany);
    this.router.get('/notification', this.auth.authority.user, this.getNoti);
    this.router.get('/:postid', this.auth.authority.user, this.getPostById);
    this.router.post('/', this.auth.authority.user, this.createPost);
    this.router.post(
      '/:postid/resolve',
      this.auth.authority.user,
      this.resolvePost,
    );
    this.router.post('/comment', this.auth.authority.user, this.createComment);
    this.router.patch('/comment', this.auth.authority.user);
    this.router.delete('/comment', this.auth.authority.user);
    this.router.delete('/:postid', this.auth.authority.user, this.deletePost);
    this.router.patch('/:postid', this.auth.authority.user, this.updatePost);
  }

  private getPostById = this.Wrapper(async (req, res) => {
    const { postid } = req.params;
    const result = await this.models.Post.findById(postid)
      .populate('user')
      .populate({ path: 'group', populate: { path: 'creator' } })
      .populate({ path: 'comment', populate: { path: 'user' } });
    if (!result) throw this.error.db.notfound();
    res(200, result);
  });

  private resolvePost = this.Wrapper(async (req, res) => {
    const { postid } = req.params;
    const post = await this.models.Post.findByIdAndUpdate(postid, {
      $set: { isResolved: true },
    }).exec();
    if (!post) throw this.error.db.notfound();
    res(200, post);
  });

  private getPostMany = this.Wrapper(async (req, res) => {
    const { group, length, search } = req.query;
    const user = await this.models.User.findById(req.body.userData._id);
    if (!user) throw this.error.auth.tokenInvalid();

    const query: any = {};

    Object.assign(query, { group: { $in: user?.group || [] } });

    Object.assign(query, { isResolved: false });

    if (group) {
      if (user?.group?.indexOf(group as any) !== -1) query.group = group;
    }
    if (search) {
      const $regex = new RegExp(
        '(' + search.toString().replace(/ /g, '|') + ')',
        'gi',
      );

      const user = (
        await this.models.User.find({ userid: $regex }).select('_id').exec()
      ).map((data) => {
        return data._id;
      });

      Object.assign(query, {
        $or: [{ title: $regex }, { user: { $in: user } }],
      });
    }

    const count = await (await this.models.Post.find(query)).length;

    const result = await this.models.Post.find(query)
      .skip(parseInt((length as string) || '0', 10))
      .limit(parseInt((length as string) || '0', 10) + 10)
      .populate('user')
      .populate({ path: 'group', populate: { path: 'creator' } })
      .populate({ path: 'comment', populate: { path: 'user' } })
      .sort('-_id')
      .exec();
    res(200, { ...result, count });
  });

  private createPost = this.Wrapper(async (req, res) => {
    const { title, description, type, time, place, reward, group } = req.body;
    const photo = req.files?.photo as any;
    Assets.checkNull(title, type, time, place, reward, group);
    const userData = {
      title,
      description,
      type,
      time,
      place,
      reward,
      group,
      user: req.body.userData._id,
    };
    if (photo) {
      const r = await Aws.S3({
        Bucket: 'mocon-drop-cdn',
        Key: `/bigfiles/${moment().format('YYYY-MM-DD_HH_mm_ss')}_${
          photo.name
        }`,
        Body: photo.data,
      });
      Object.assign(userData, { photo: r.Location });
    }

    const keywordRegex = new RegExp(
      '(' + title.toString().replace(/ /g, '|') + ')',
      'gi',
    );

    const result = await this.models.Post.create(userData);
    if (!result) throw this.error.db.create();

    const keywordTargetUser = await this.models.User.find({
      keyword: keywordRegex,
    }).exec();

    if (keywordTargetUser) {
      keywordTargetUser.forEach(async (user) => {
        await firebase.messaging().send({
          notification: { title: `키워드 알림`, body: title },
          token: user.fcmtoken,
        });
      });
      const noti = new this.models.Noti({
        targetUser: keywordTargetUser,
        post: result._id,
        title: `키워드 알림`,
        content: title,
      });
      await noti.save();
    }

    res(201, result);
  });

  private createComment = this.Wrapper(async (req, res) => {
    const { postid, time, content, isImportant } = req.body;
    Assets.checkNull(postid, content, isImportant);
    const post = await this.models.Post.findById(postid)
      .populate('user')
      .exec();
    if (!post) throw this.error.db.notfound();
    // eslint-disable-next-line no-unused-expressions
    post.comment &&
      post.comment.push({
        content,
        isImportant,
        time,
        user: req.body.userData._id,
      });
    const newPost = await this.models.Post.findByIdAndUpdate(postid, post);
    if (!newPost) throw this.error.db.create('comment');

    const requestUser = await this.models.User.findById(
      req.body.userData._id,
    ).exec();

    const commentData = {
      title: `새로운 댓글`,
      content: `${requestUser?.name}님이 [${post.title}]게시물에 댓글을 남겻습니다.`,
    };

    const commentList: string[] = [];

    const userList: { _id: Schema.Types.ObjectId[]; fcmtoken: string[] } = {
      _id: [],
      fcmtoken: [],
    };

    // eslint-disable-next-line no-unused-expressions
    post.comment?.forEach(async (result) => {
      if (
        commentList.indexOf(result.user.toString()) !== -1 ||
        req.body.userData._id.toString() === post.user.toString()
      )
        return;
      commentList.push(result.user.toString());
    });

    commentList.forEach(async (comment) => {
      const targetUser = await this.models.User.findById(
        mongoose.Types.ObjectId(comment),
      ).exec();
      if (
        post.user.toString() === req.body.userData._id.toString() ||
        targetUser === null ||
        userList.fcmtoken.indexOf(targetUser.fcmtoken) !== -1
      )
        return;
      userList.fcmtoken.push(targetUser.fcmtoken);
      userList._id.push(targetUser._id);
    });

    if (
      req.body.userData._id.toString() !== post.user.toString() &&
      userList.fcmtoken.indexOf((post.user as any).fcmtoken) === -1
    ) {
      userList.fcmtoken.push((post.user as any).fcmtoken);
      userList._id.push((post.user as any)._id);
    }

    if (req.body.userData._id.toString() !== post.user.toString()) {
      const deleteUser: any = await this.models.User.findById(
        req.body.userData._id,
      ).exec();
      userList._id.splice(userList._id.indexOf(req.body.userData._id), 1);
      userList.fcmtoken.splice(
        userList.fcmtoken.indexOf(deleteUser?.fcmtoken),
        1,
      );
    }
    await this.models.Noti.create({
      targetUser: userList._id,
      ...commentData,
      post: post._id,
    });

    if (userList.fcmtoken.length !== 0) {
      await firebase.messaging().sendAll(
        userList.fcmtoken.map((token) => ({
          notification: { title: commentData.title, body: commentData.content },
          token,
        })),
      );
    }

    res(200, newPost);
  });

  private updatePost = this.Wrapper(async (req, res) => {
    const { title, description, type, time, place, reward, group } = req.body;
    const photo = req.files?.photo as UploadedFile;
    const { postid } = req.params;

    const newDoc = {};

    if (photo) {
      const r = await Aws.S3({
        Bucket: 'mocon-drop-cdn',
        Key: `/bigfiles/${moment().format('YYYY-MM-DD_HH_mm_ss')}_${
          photo.name
        }`,
        Body: photo.data,
      });
      Object.assign(newDoc, { photo: r.Location });
    }

    Object.assign(
      newDoc,
      this.assets.updateQueryBuilder({
        title,
        description,
        type,
        time,
        place,
        reward,
        group,
      }),
    );

    const post = await this.models.Post.findByIdAndUpdate(postid, {
      $set: newDoc,
    });
    if (!post) throw this.error.db.notfound();
    res(200, post);
  });

  private getNoti = this.Wrapper(async (req, res) => {
    const noti = await this.models.Noti.find({
      targetUser: req.body.userData._id,
    })
      .populate('targetUser')
      .populate({
        path: 'post',
        populate: [
          { path: 'group', populate: { path: 'creator' } },
          'user',
          { path: 'comment', populate: 'user' },
        ],
      })
      .sort('-_id')
      .exec();
    res(200, noti);
  });

  private deletePost = this.Wrapper(async (req, res) => {
    const { postid } = req.params;
    const post = await this.models.Post.findOneAndDelete({
      _id: postid,
      user: req.body.userData._id,
    }).exec();
    if (!post) throw this.error.db.notfound();
    res(200, post);
  });
})();
