export function mapBaseUrlByModel(model) {
  switch (model) {
    case 'deepseek-v3':
      return 'https://api.deepseek.com';
    case 'qwen-mt-turbo':
    case 'qwen-mt-plus':
      return 'https://dashscope.aliyuncs.com';
    case 'gpt-4o-mini':
      return 'https://api.openai.com';
    default:
      return '';
  }
}
