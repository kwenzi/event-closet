export default (providedOptions, defaultOptions) =>
  Object.keys(defaultOptions)
    .reduce((obj, option) => ({
      ...obj,
      [option]: providedOptions[option] !== undefined
        ? providedOptions[option]
        : defaultOptions[option],
    }), {});
