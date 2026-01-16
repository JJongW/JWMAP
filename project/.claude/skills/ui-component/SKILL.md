---
name: ui-component
description: 프로젝트 스타일에 맞는 React UI 컴포넌트를 생성합니다. 새로운 컴포넌트, 버튼, 카드, 모달, 폼 요소 등을 만들 때 사용합니다.
---

# UI 컴포넌트 생성 가이드

## 프로젝트 스타일 규칙

### 1. 파일 구조
```typescript
import { useState } from 'react';
import { IconName } from 'lucide-react';
import { clsx } from 'clsx';

interface ComponentNameProps {
  // props 정의
}

export function ComponentName({ ...props }: ComponentNameProps) {
  return (
    // JSX
  );
}
```

### 2. Tailwind 스타일 컨벤션

**Border Radius:**
- 작은 요소: `rounded-lg`
- 중간 요소: `rounded-xl`
- 큰 요소/카드: `rounded-2xl`

**Colors (Primary - Orange):**
- 메인: `bg-orange-500`, `text-orange-500`
- 호버: `hover:bg-orange-600`
- 연한: `bg-orange-50`, `bg-orange-100`
- 포커스: `focus:ring-orange-500`, `focus:border-orange-400`

**Colors (Secondary - Gray):**
- 배경: `bg-gray-50`, `bg-gray-100`
- 테두리: `border-gray-100`, `border-gray-200`
- 텍스트: `text-gray-400`, `text-gray-500`, `text-gray-600`, `text-gray-700`, `text-gray-900`

**Spacing:**
- 패딩: `p-3`, `p-4`, `p-5`, `px-4 py-2.5`
- 마진: `mb-1.5`, `mb-2`, `mb-4`, `mt-2`
- 갭: `gap-2`, `gap-3`, `gap-4`

**Typography:**
- 제목: `text-lg font-bold text-gray-900`
- 라벨: `text-sm font-medium text-gray-700`
- 섹션 헤더: `text-sm font-semibold text-gray-500 uppercase tracking-wide`
- 본문: `text-sm text-gray-600`
- 작은 텍스트: `text-xs text-gray-500`

**Effects:**
- 전환: `transition-all duration-200` 또는 `transition-colors`
- 그림자: `shadow-lg`, `hover:shadow-md`
- 호버: `hover:bg-gray-200`

### 3. 버튼 스타일

**Primary 버튼:**
```jsx
<button className="px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors flex items-center gap-2">
  <Icon size={18} />
  버튼 텍스트
</button>
```

**Secondary 버튼:**
```jsx
<button className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
  버튼 텍스트
</button>
```

**토글 버튼 (Active/Inactive):**
```jsx
<button className={clsx(
  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
  isActive
    ? 'bg-orange-500 text-white'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
)}>
```

**위험 버튼:**
```jsx
<button className="px-3 py-2.5 bg-red-50 text-red-500 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors">
```

### 4. 카드 스타일

```jsx
<div className="bg-white rounded-2xl border border-gray-100 p-5">
  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
    섹션 제목
  </h2>
  {/* 내용 */}
</div>
```

### 5. Input 스타일

```jsx
<input
  type="text"
  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
  placeholder="플레이스홀더"
/>
```

### 6. 모달 스타일

```jsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
    {/* 헤더 */}
    <div className="flex items-center justify-between p-5 border-b border-gray-100">
      <h2 className="text-lg font-bold text-gray-900">모달 제목</h2>
      <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
        <X size={20} className="text-gray-500" />
      </button>
    </div>
    {/* 내용 */}
    <div className="p-5 space-y-4">
      {/* ... */}
    </div>
    {/* 푸터 */}
    <div className="flex gap-3 p-5 border-t border-gray-100">
      {/* 버튼들 */}
    </div>
  </div>
</div>
```

### 7. 태그/뱃지 스타일

**Primary 뱃지:**
```jsx
<span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-500 text-white">
```

**Info 뱃지:**
```jsx
<span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600">
```

**Subtle 뱃지:**
```jsx
<span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700">
```

### 8. 아이콘 사용

- lucide-react 라이브러리 사용
- 작은 아이콘: `size={14}` 또는 `size={16}`
- 중간 아이콘: `size={18}` 또는 `size={20}`
- 큰 아이콘: `className="w-8 h-8"`

### 9. 반응형 규칙

- 모바일 우선
- 브레이크포인트: `sm:`, `lg:`
- 예: `px-3 sm:px-4`, `hidden sm:inline`

---

## 컴포넌트 생성 체크리스트

1. [ ] TypeScript interface로 props 정의
2. [ ] Named export 사용 (`export function`)
3. [ ] clsx로 조건부 클래스 처리
4. [ ] 프로젝트 색상 팔레트 준수 (orange/gray)
5. [ ] 적절한 border-radius 사용
6. [ ] transition 효과 추가
7. [ ] 한국어 주석 작성
8. [ ] 반응형 고려

---

## 예시: 새 컴포넌트 생성

요청: "알림 배너 컴포넌트 만들어줘"

```typescript
import { X, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

type AlertType = 'info' | 'success' | 'warning';

interface AlertBannerProps {
  type: AlertType;
  message: string;
  onClose?: () => void;
}

const alertStyles: Record<AlertType, { bg: string; text: string; icon: typeof Info }> = {
  info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: Info },
  success: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: CheckCircle },
  warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
};

export function AlertBanner({ type, message, onClose }: AlertBannerProps) {
  const style = alertStyles[type];
  const Icon = style.icon;

  return (
    <div className={clsx(
      'flex items-center justify-between p-4 rounded-xl border',
      style.bg
    )}>
      <div className="flex items-center gap-3">
        <Icon size={20} className={style.text} />
        <p className={clsx('text-sm font-medium', style.text)}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={clsx(
            'p-1 rounded-lg hover:bg-white/50 transition-colors',
            style.text
          )}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
```
