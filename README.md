# short-tiktok-like-site

Short video social media site inspired by TikTok with profile, followers, chat requests, and video upload/camera features.

## Como executar localmente

1. Abra a pasta do projeto.
2. Rode um servidor estático:

```bash
python3 -m http.server 3000
```

3. Acesse:

```text
http://localhost:3000
```

## Funcionalidades incluídas

- Feed vertical estilo TikTok
- Cadastro e login com nome e senha
- Perfil personalizado
- Publicação com vídeo ou imagem
- Câmera com efeito de rosto e gravação curta
- Curtidas e comentários básicos
- Seguidores e seguindo
- Solicitações de seguir com aprovação
- Chat entre perfis aprovados
- Persistência em localStorage

## Deploy online

Este projeto é um site estático e pode ser publicado facilmente em:

- GitHub Pages
- Vercel
- Netlify

## Observação

Este é um MVP funcional no frontend, com dados locais no navegador. Para uso real em produção, seria necessário conectar um backend, autenticação real e armazenamento de vídeos em serviço de nuvem.
