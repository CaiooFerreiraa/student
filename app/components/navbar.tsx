export default function Navbar() {
  return (
    <div>
      <div>
        <div>        
          <span><i>icon</i></span>
          <span>nome plataforma</span>
        </div>

        <button>Menu</button>
      </div>

      <div>
        <a href="#">Inicio</a>
        <a href="#">Quizzes</a>
        <a href="#">Criar Quiz</a>
        <a href="#">Materias</a>
        <a href="#">Chat IA</a>
        <a href="#">Desempenho</a>
        <a href="#">Configurações</a>
      </div>

      <div>
        <img src="#" alt="foto-perfil" />
        <div>
          <span>Nome do usuário</span>
          <select name="perfil" id="perfil">Ver perfil</select>
        </div>
      </div>
    </div>
  )
}