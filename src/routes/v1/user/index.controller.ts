import Controller from '@lib/blueprint/Controller';
import User from '@models/User';
import Aws from '@util/Aws';
import moment from 'moment';
import { UploadedFile } from 'express-fileupload';

export default new (class extends Controller {
  constructor() {
    super();
    this.router.get(
      '/',
      this.assets.apiRateLimiter(1, 10),
      this.auth.authority.user,
      this.getUser,
    );
    this.router.post('/', this.assets.apiRateLimiter(5, 5), this.createUser);
    this.router.patch(
      '/',
      this.assets.apiRateLimiter(1, 10),
      this.auth.authority.user,
      this.updateUser,
    );
    this.router.delete(
      '/',
      this.assets.apiRateLimiter(1, 10),
      this.auth.authority.user,
      this.deleteUser,
    );
  }

  private createUser = this.Wrapper(async (req, res) => {
    const { userid, password, name, fcmtoken, keyword } = req.body;
    this.assets.checkNull(userid, password, name);
    const photo = req.files?.photo as any;

    const hashResult = this.auth.password.create(password);
    const userValue = {
      userid,
      ...hashResult,
      name,
      fcmtoken,
      keyword,
    };
    if (photo) {
      const uploadResult = await Aws.S3({
        Bucket: 'mocon-drop-cdn',
        Key: `/bigfiles/${moment().format('YYYY-MM-DD_HH_mm_ss')}_${
          photo.name
        }`,
        Body: photo.data,
      });
      Object.assign(userValue, { photo: uploadResult.Location });
    }
    const user = new User(userValue);
    await user.save();
    res(201, user, { message: 'Created user successfully.' });
  });

  private updateUser = this.Wrapper(async (req, res) => {
    const { password, name, keyword } = req.body;
    const photo = req.files?.photo as UploadedFile;
    const newDoc = {};
    if (photo) {
      const uploadResult = await Aws.S3({
        Bucket: 'mocon-drop-cdn',
        Key: `/bigfiles/${moment().format('YYYY-MM-DD_HH_mm_ss')}_${
          photo.name
        }`,
        Body: photo.data,
      });
      Object.assign(newDoc, { photo: uploadResult.Location });
    }
    if (password) {
      const hashResult = password ? this.auth.password.create(password) : null;
      Object.assign(newDoc, hashResult);
    }
    if (name) {
      Object.assign(newDoc, { name });
    }
    if (keyword) {
      Object.assign(newDoc, { keyword });
    }

    const user = await User.findByIdAndUpdate(req.body.userData._id, {
      $set: newDoc,
    }).exec();
    if (!user) throw this.error.db.notfound();
    res(200, user, { message: 'User data update successful' });
  });

  private getUser = this.Wrapper(async (req, res) => {
    const { userData } = req.body;
    const user = await User.findById(userData._id).exec();
    if (!user) throw this.error.db.notfound();
    res(200, user, { message: 'Data found' });
  });

  private deleteUser = this.Wrapper(async (req, res) => {
    const { userData } = req.body;
    const user = await User.findByIdAndDelete(userData._id, {})
      .select('userid authority')
      .exec();
    if (!user) throw this.error.db.notfound();
    res(200, user, { message: 'User removal successful' });
  });
})();
