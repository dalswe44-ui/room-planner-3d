import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base를 상대 경로로 두어 어떤 정적 호스팅의 하위 경로에 올려도 열리게 한다.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
  },
});
