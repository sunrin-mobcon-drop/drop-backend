import AWS from 'aws-sdk';
import error from '@error';

async function S3(
  param: AWS.S3.PutObjectRequest,
): Promise<AWS.S3.ManagedUpload.SendData> {
  const s3 = new AWS.S3({
    accessKeyId: process.env.S3_PUB_KEY,
    secretAccessKey: process.env.S3_PRIV_KEY,
    region: process.env.S3_REGION,
  });

  return await new Promise(function (resolve, reject) {
    s3.upload(param, (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  })
    .then((data) => {
      return data as AWS.S3.ManagedUpload.SendData;
    })
    .catch(() => {
      throw error.aws.S3();
    });
}

export default {
  S3,
};
