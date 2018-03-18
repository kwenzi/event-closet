import getOptions from '../src/get-options';

describe('getOptions', () => {
  test('return the provided value if presend, the default value if not', () => {
    const options = getOptions({ opt1: 'foo' }, { opt1: 'default1', opt2: 'default2' });
    expect(options).toEqual({ opt1: 'foo', opt2: 'default2' });
  });

  test('dont return a value that isnt in the default values', () => {
    const options = getOptions({ optX: 'foo' }, {});
    expect(options).toEqual({});
  });
});
