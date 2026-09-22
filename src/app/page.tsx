import { SERVICE_NAME } from "@/shared/config/service";

/** 셸 확인용 임시 화면. 목록 화면은 다음 단계에서 views로 배치한다. */
export default function Home() {
  return (
    <main className="p-page">
      <h1 className="text-title">{SERVICE_NAME}</h1>
      <p className="text-body text-text-2">화면을 준비하고 있어요.</p>
    </main>
  );
}
