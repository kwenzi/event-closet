import { Readable } from 'stream';
import consumeStream from '../src/consume-stream';

const okStream = () => {
  let count = 1;
  return new Readable({
    objectMode: true,
    read() {
      this.push({ count });
      count += 1;
      if (count > 10) { this.push(null); }
    },
  });
};

const errorStream = () =>
  new Readable({
    objectMode: true,
    read() {
      this.emit('error', new Error('read error'));
    },
  });

describe('consumeStream', () => {
  test('works with sync consumer', async () => {
    let result = 0;
    await consumeStream(okStream(), (data) => { result += data.count; });
    expect(result).toBe(55); // sum 1 to 10
  });

  test('works with async consumer', async () => {
    let result = 0;
    await consumeStream(okStream(), async (data) => {
      await new Promise((resolve) => { setTimeout(resolve, 5); });
      result += data.count;
    });
    expect(result).toBe(55); // sum 1 to 10
  });

  test('rejects if consumer throws an error', async () => {
    await expect(consumeStream(okStream(), () => {
      throw new Error('consume error');
    })).rejects.toEqual(new Error('consume error'));
  });

  test('rejects if readable stream emits an error', async () => {
    await expect(consumeStream(errorStream(), () => { }))
      .rejects.toEqual(new Error('read error'));
  });
});
