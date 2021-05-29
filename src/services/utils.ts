export const splitArray = <Type>(array: Array<Type>, size: number = 10): Array<Array<Type>> => {
  let result = [];

  for (let i = 0; i < array.length; i++) {
    const idx = Math.floor(i / size);
    const resultItem = result[idx] || [];
    result[idx] = [...resultItem, array[i]]
  }

  return result;
}
