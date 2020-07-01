import Controller from '@lib/blueprint/Controller';
import Assets from '@util/Assets';
import Aws from '@util/Aws';
import moment from 'moment';

export default new (class extends Controller {
  constructor() {
    super();
    this.router.get('/', this.auth.authority.user, this.getGroup);
    this.router.get('/user', this.auth.authority.user, this.getGroupOfUser);
    this.router.get(
      '/:groupid',
      this.auth.authority.user,
      this.getGroupByGroupId,
    );
    this.router.post('/', this.auth.authority.user, this.createGroup);
    this.router.post('/join', this.auth.authority.user, this.joinGroup);
  }

  private getGroupOfUser = this.Wrapper(async (req, res) => {
    const user = await this.models.User.findById(req.body.userData._id).exec();
    const result = await this.models.Group.find({ _id: { $in: user?.group } })
      .populate('creator')
      .sort('-_id')
      .exec();
    if (result.length === 0) throw this.error.db.notfound();
    res(200, result);
  });

  private getGroup = this.Wrapper(async (req, res) => {
    const group = await this.models.Group.find({}).populate('creator').exec();
    res(200, group);
  });

  private getGroupByGroupId = this.Wrapper(async (req, res) => {
    const { groupid } = req.params;
    const group = await this.models.Group.findById(groupid)
      .populate('creator')
      .exec();
    if (!group) throw this.error.db.notfound();
    res(200, group);
  });

  private createGroup = this.Wrapper(async (req, res) => {
    const { name, description } = req.body;
    const photo = req.files?.photo as any;
    Assets.checkNull(name);
    let uploadResult;
    if (photo) {
      uploadResult = await Aws.S3({
        Bucket: 'mocon-drop-cdn',
        Key: `/bigfiles/${moment().format('YYYY-MM-DD_HH_mm_ss')}_${
          photo.name
        }`,
        Body: photo.data,
      });
    }

    const data: any = { name, description, creator: req.body.userData._id };
    if (uploadResult) {
      data.photo = uploadResult.Location;
    }

    const group = await this.models.Group.create(data);
    const _user = await this.models.User.findById(req.body.userData._id);
    // eslint-disable-next-line no-unused-expressions
    _user?.group?.push(group._id);
    const user = await this.models.User.findByIdAndUpdate(
      req.body.userData._id,
      _user as any,
    );
    if (!group) throw this.error.db.create();
    res(201, { group, user });
  });

  private joinGroup = this.Wrapper(async (req, res) => {
    const { group } = req.body;
    const user: any = await this.models.User.findById(req.body.userData._id);
    if (user?.group.indexOf(group) !== -1) throw this.error.db.exists();
    // eslint-disable-next-line no-unused-expressions
    user?.group?.push(group);
    const newUser = await this.models.User.findByIdAndUpdate(
      req.body.userData._id,
      user,
    );
    res(200, newUser as any);
  });
})();
