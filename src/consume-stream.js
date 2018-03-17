import { Writable } from 'stream';

export default async (stream, f) => {
  await new Promise((resolve, reject) => {
    const writable = new Writable({
      objectMode: true,
      async write(object, encoding, callback) {
        try {
          await f(object);
        } catch (err) {
          reject(err);
        }
        callback();
      },
    });
    stream.on('error', reject);
    writable.on('finish', resolve);
    stream.pipe(writable);
  });
};
