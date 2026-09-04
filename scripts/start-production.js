import { spawn } from 'child_process';

console.log('[Hub MultiFarma] Inicializando ambiente de produção...');

// 1. Iniciar Serviço de Integração (Express - Porta 3001)
const integrationProcess = spawn('node', ['./apps/integration-service/dist/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.INTEGRATION_PORT || '3001' }
});

integrationProcess.on('error', (err) => {
  console.error('[Hub MultiFarma] Erro no Serviço de Integração:', err);
});

// 2. Iniciar Aplicação Web (Next.js - Porta 3000)
const webProcess = spawn('npm', ['run', 'start', '--workspace=@hub-farmacia/web'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.PORT || '3000' }
});

webProcess.on('error', (err) => {
  console.error('[Hub MultiFarma] Erro na Aplicação Web:', err);
});

const cleanup = () => {
  console.log('[Hub MultiFarma] Encerrando serviços...');
  integrationProcess.kill();
  webProcess.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
