import { FileUIPart } from 'ai';
import { atom } from 'jotai';

export type SendMessageFunction = (
  message: { text?: string; files?: FileList | FileUIPart[] },
  options?: { body?: Record<string, any> }
) => void;

export const sendMessageAtom = atom<SendMessageFunction | null>(null);

export const chatIdAtom = atom<string | null>(null);

