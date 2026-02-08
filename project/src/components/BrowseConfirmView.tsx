/**
 * BrowseConfirmView.tsx
 *
 * Browse 진입 전 의도적 마찰을 만드는 인터스티셜 가드.
 *
 * 목적:
 * - 사용자가 "직접 둘러보기"를 선택하기 전에 한 번 멈추게 한다.
 * - 의식적으로 탐색을 선택하도록 유도하되, Decision 경로로 돌아가는 것이
 *   더 크고 명확하게 보이도록 시각적 위계를 설정한다.
 *
 * 디자인 원칙:
 * - calm, minimal, 이미지 없음
 * - Primary CTA는 "다시 정해줘" (Decision 복귀)
 * - Secondary CTA는 "직접 둘러보기" (Browse 진입) — 작고 muted
 */

interface BrowseConfirmViewProps {
  /** Decision 화면으로 돌아가기 */
  onBackToDecision: () => void;
  /** Browse 화면으로 진입 */
  onProceedToBrowse: () => void;
}

export function BrowseConfirmView({
  onBackToDecision,
  onProceedToBrowse,
}: BrowseConfirmViewProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-white">
      <div className="mx-auto w-full max-w-sm px-6 text-center">

        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          직접 고르시겠어요?
        </h1>

        {/* Body — 의도적으로 탐색이 번거로울 수 있음을 암시 */}
        <p className="mt-4 text-base leading-relaxed text-gray-400">
          조금 시간이 걸릴 수 있어요.<br />
          그래도 괜찮다면 둘러보세요.
        </p>

        {/* CTA 영역 — Primary가 시각적으로 압도적으로 크다 */}
        <div className="mt-10 flex flex-col items-center gap-4">
          {/* Primary: Decision 복귀 (크고 강조) */}
          <button
            onClick={onBackToDecision}
            className="w-full rounded-2xl bg-gray-900 py-4 text-base font-semibold text-white transition-all duration-150 active:scale-[0.98]"
          >
            다시 정해줘
          </button>

          {/* Secondary: Browse 진입 (작고 muted) */}
          <button
            onClick={onProceedToBrowse}
            className="text-sm text-gray-400 transition-colors hover:text-gray-500"
          >
            직접 둘러보기
          </button>
        </div>
      </div>
    </div>
  );
}
