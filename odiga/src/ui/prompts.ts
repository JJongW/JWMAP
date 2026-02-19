import Enquirer from 'enquirer';

export type ListChoice = 'r' | 'n' | 'q' | number;

export async function selectPlace(placeCount: number): Promise<ListChoice> {
  const choices = [];
  for (let i = 1; i <= placeCount; i++) {
    choices.push({ name: String(i), message: `${i}번 장소 상세보기` });
  }
  choices.push({ name: 'r', message: '다시 추천받기' });
  choices.push({ name: 'n', message: '다른 검색어로 다시 찾기' });
  choices.push({ name: 'q', message: '취소하고 종료' });

  const { choice } = await (Enquirer as any).prompt({
    type: 'select',
    name: 'choice',
    message: '어디로 갈까요?',
    choices,
  });

  if (choice === 'r') return 'r';
  if (choice === 'n') return 'n';
  if (choice === 'q') return 'q';
  return parseInt(choice, 10);
}

export async function selectCourse(courseCount: number): Promise<ListChoice> {
  const choices = [];
  for (let i = 1; i <= courseCount; i++) {
    choices.push({ name: String(i), message: `코스 ${i} 선택` });
  }
  choices.push({ name: 'r', message: '다시 추천받기' });
  choices.push({ name: 'n', message: '다른 검색어로 다시 찾기' });
  choices.push({ name: 'q', message: '취소하고 종료' });

  const { choice } = await (Enquirer as any).prompt({
    type: 'select',
    name: 'choice',
    message: '어떤 코스로 가볼까요?',
    choices,
  });

  if (choice === 'r') return 'r';
  if (choice === 'n') return 'n';
  if (choice === 'q') return 'q';
  return parseInt(choice, 10);
}

export async function confirmSave(): Promise<boolean> {
  const { save } = await (Enquirer as any).prompt({
    type: 'confirm',
    name: 'save',
    message: '저장할까요?',
    initial: false,
  });

  return save;
}

export async function askFeedback(): Promise<string> {
  const { feedback } = await (Enquirer as any).prompt({
    type: 'input',
    name: 'feedback',
    message: '어떤 점이 마음에 안 들었나요? (Enter로 건너뛰기)',
  });

  return (feedback || '').trim();
}

export async function askNewSearchQuery(): Promise<string> {
  const { query } = await (Enquirer as any).prompt({
    type: 'input',
    name: 'query',
    message: '새로 찾을 검색어를 입력해주세요 (Enter로 취소)',
  });

  return (query || '').trim();
}

export async function askRegion(): Promise<string> {
  const { region } = await (Enquirer as any).prompt({
    type: 'input',
    name: 'region',
    message: '먼저 지역을 정해주세요 (예: 강남, 홍대/합정/마포/연남, 서울)',
  });

  return (region || '').trim();
}

export async function confirmStory(): Promise<boolean> {
  const { story } = await (Enquirer as any).prompt({
    type: 'confirm',
    name: 'story',
    message: '이 코스에 대한 짧은 이야기를 만들까요?',
    initial: true,
  });

  return story;
}
