import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import type { Course } from '../engine/courseBuilder.js';

export async function generateStory(course: Course): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return '';

  const stepNames = course.steps.map((s) => s.place.name).join(' → ');
  const prompt = `다음 산책 코스에 대해 감성적인 3문장 짧은 이야기를 만들어줘. 한국어로.

코스: ${stepNames}
분위기: ${course.vibes.join(', ')}
모드: ${course.mode}

3문장만 써줘. 감성적이고 따뜻한 톤으로.`;

  try {
    const llm = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      maxOutputTokens: 200,
      apiKey,
    });

    const response = await llm.invoke([new HumanMessage(prompt)]);
    const content = typeof response.content === 'string' ? response.content : '';
    return content.trim();
  } catch {
    return '';
  }
}
