import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [mensagens, setMensagens] = useState([
    { remetente: 'bot', texto: 'Olá! Sou o assistente virtual oficial. Como posso ajudar você hoje com as informações do manual do aluno?' }
  ]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const fimDoChatRef = useRef(null);

  // Faz o chat rolar automaticamente para a mensagem mais recente
  const rolarParaBaixo = () => {
    fimDoChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    rolarParaBaixo();
  }, [mensagens, carregando]);

  const enviarMensagem = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const novaMensagemUsuario = { remetente: 'user', texto: input };
    setMensagens((prev) => [...prev, novaMensagemUsuario]);
    setInput('');
    setCarregando(true);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: novaMensagemUsuario.texto }),
      });

      const data = await response.json();

      setMensagens((prev) => [
        ...prev,
        { remetente: 'bot', texto: data.resposta }
      ]);
    } catch (error) {
      setMensagens((prev) => [
        ...prev,
        { remetente: 'bot', texto: 'Desculpe, ocorreu um erro ao conectar com o servidor. Tente novamente.' }
      ]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="app-background">
      <div className="chat-container">
        {/* Cabeçalho Institucional */}
        <header className="chat-header">
          <h2>Assistente Virtual da Faculdade</h2>
          <p>Tire suas dúvidas sobre o manual do aluno</p>
        </header>

        {/* Área de Mensagens */}
        <div className="chat-messages">
          {mensagens.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.remetente}`}>
              <div className={`message ${msg.remetente}`}>
                {msg.texto}
              </div>
            </div>
          ))}

          {/* Indicador de "Digitando..." */}
          {carregando && (
            <div className="message-wrapper bot">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={fimDoChatRef} />
        </div>

        {/* Área de Input */}
        <form className="chat-input-container" onSubmit={enviarMensagem}>
          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua dúvida aqui..."
            disabled={carregando}
          />
          <button
            type="submit"
            className="send-button"
            disabled={carregando || !input.trim()}
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;