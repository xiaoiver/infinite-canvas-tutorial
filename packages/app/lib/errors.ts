
// 错误代码类型
export type ChatErrorCode =
  | 'AUTHENTICATION_ERROR' // API Key 认证错误
  | 'MODEL_NOT_FOUND' // 未找到模型
  | 'UNAUTHORIZED' // 用户未授权
  | 'INTERNAL_ERROR'; // 内部服务器错误

/**
 * 判断错误是否是认证错误
 */
export function isAuthenticationError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : '';
  const errorString = String(error);

  // Gateway 认证错误
  if (
    errorMessage.includes('GatewayAuthenticationError') ||
    errorString.includes('GatewayAuthenticationError') ||
    errorName === 'GatewayAuthenticationError'
  ) {
    return true;
  }

  // OpenAI 认证错误
  if (
    errorMessage.includes('401') ||
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('Invalid API key') ||
    errorMessage.includes('Incorrect API key')
  ) {
    return true;
  }

  // Google 认证错误
  if (
    errorMessage.includes('401') ||
    errorMessage.includes('Unauthenticated') ||
    errorMessage.includes('API key not valid')
  ) {
    return true;
  }

  return false;
}

export function getChatErrorCode(error: unknown): ChatErrorCode | null {
  if (!error) return null;
  if (isAuthenticationError(error)) return 'AUTHENTICATION_ERROR';
  if (error instanceof Error) return error.name as ChatErrorCode;
  return 'INTERNAL_ERROR';
}