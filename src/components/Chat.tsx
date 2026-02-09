import { useMemo, useState } from "react";
import type { ChatMessage } from "../../shared/game";

type ChatTab = "general" | "team";

type ChatProps = {
  generalMessages: ChatMessage[];
  teamMessages: ChatMessage[];
  onSendGeneral: (text: string) => void;
  onSendTeam: (text: string) => void;
  teamLabel: string;
  isConnected: boolean;
};

const Chat = ({
  generalMessages,
  teamMessages,
  onSendGeneral,
  onSendTeam,
  teamLabel,
  isConnected,
}: ChatProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState<ChatTab>("general");

  const activeMessages = useMemo(() => {
    const source = activeTab === "general" ? generalMessages : teamMessages;
    return [...source].sort((a, b) => a.createdAt - b.createdAt);
  }, [activeTab, generalMessages, teamMessages]);

  const handleSendMessage = () => {
    const text = inputValue.trim();
    if (!text) {
      return;
    }
    if (activeTab === "general") {
      onSendGeneral(text);
    } else {
      onSendTeam(text);
    }
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          left: isOpen ? '320px' : '20px',
          top: '20px',
          zIndex: 1001,
          backgroundColor: 'white',
          color: '#333',
          border: '1px solid #ddd',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          cursor: 'pointer',
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'white';
        }}
      >
        {isOpen ? '‹' : '›'}
      </button>

      <div
        style={{
          position: 'fixed',
          left: isOpen ? '0' : '-350px',
          top: '0',
          height: '100vh',
          width: '300px',
          backgroundColor: 'white',
          boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
          transition: 'left 0.3s ease',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            backgroundColor: '#f8f9fa',
            padding: '20px',
            color: '#333',
            fontSize: '20px',
            fontWeight: 'bold',
            textAlign: 'center',
            borderBottom: '1px solid #e0e0e0',
          }}
        >
          Chat
        </div>

        <div
          style={{
            display: 'flex',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e0e0e0',
          }}
        >
          <button
            onClick={() => setActiveTab("general")}
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: activeTab === "general" ? 'white' : 'transparent',
              color: activeTab === "general" ? '#333' : '#999',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === "general" ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              borderBottom: activeTab === "general" ? '3px solid #000000' : 'none',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "general") {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "general") {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Général
          </button>
          <button
            onClick={() => setActiveTab("team")}
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: activeTab === "team" ? 'white' : 'transparent',
              color: activeTab === "team" ? '#333' : '#999',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === "team" ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              borderBottom: activeTab === "team" ? '3px solid #000000' : 'none',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "team") {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "team") {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Équipe{teamLabel ? ` (${teamLabel})` : ""}
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {activeMessages.map((message) => (
            <div
              key={message.id}
              style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '10px',
                animation: 'fadeIn 0.3s ease',
                border: '1px solid #e0e0e0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '5px',
                }}
              >
                <span
                  style={{
                    color: '#3498DB',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                >
                  {message.user.name}
                </span>
              </div>
              <div
                style={{
                  color: '#333',
                  fontSize: '13px',
                  lineHeight: '1.4',
                }}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>

        <div style={{padding: '15px', backgroundColor: '#f8f9fa', borderTop: '1px solid #e0e0e0'}}>
          <div style={{display: 'flex', gap: '10px'}}>
            <input
              type="text"
              placeholder={isConnected ? "Écrire un message..." : "Connecte-toi pour discuter"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                backgroundColor: 'white',
                color: '#333',
                fontSize: '13px',
                outline: 'none',
                cursor: isConnected ? 'text' : 'not-allowed',
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!isConnected}
              style={{
                padding: '10px 15px',
                borderRadius: '5px',
                border: '1px solid #3498DB',
                backgroundColor: '#3498DB',
                color: 'white',
                cursor: isConnected ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                opacity: isConnected ? 1 : 0.6,
              }}
              onMouseEnter={(e) => {
                if (isConnected) {
                  e.currentTarget.style.backgroundColor = '#2980B9';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3498DB';
              }}
            >
              Envoyer
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export default Chat;