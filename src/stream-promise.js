export default async (stream, f) => {
  await new Promise((resolve, reject) => {
    stream.on('data', f);
    stream.on('end', resolve);
    stream.on('error', reject);
  });
};
