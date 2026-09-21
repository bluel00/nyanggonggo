/** 요청 값 오류(400). 메시지는 클라이언트에 그대로 보여도 되는 내용만 담는다. */
export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRequestError";
  }
}

/** 없는 공고(404) */
export class NotFoundError extends Error {
  constructor() {
    super("Animal not found");
    this.name = "NotFoundError";
  }
}
