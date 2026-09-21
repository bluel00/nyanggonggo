/**
 * inputs를 최대 concurrency개씩 동시에 처리한다. 결과는 입력 순서를 따른다.
 * 하나라도 실패하면 전체가 실패한다(이미 시작한 작업은 끝까지 돈다).
 */
export async function mapWithConcurrency<T, R>(
  inputs: readonly T[],
  concurrency: number,
  task: (input: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(inputs.length);
  let next = 0;
  const worker = async () => {
    while (next < inputs.length) {
      const index = next++;
      results[index] = await task(inputs[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, inputs.length)) }, worker));
  return results;
}
