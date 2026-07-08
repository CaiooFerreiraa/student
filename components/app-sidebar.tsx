import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu
} from "@/components/ui/sidebar"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader/>
        <SidebarMenu>
          <div className="flex justify-around">
            <span>Icon</span>
            <span>Name Plataforma</span>
          </div>
        </SidebarMenu>
      <SidebarContent>
        <SidebarGroup>
          <a href="#">Inicio</a>
          <a href="#">Quizzes</a>
          <a href="#">Criar Quizzes</a>
          <a href="#">Materiais</a>
          <a href="#">Chat IA</a>
          <a href="#">Desempenho</a>
          <a href="#">Configurações</a>
        </SidebarGroup>
        <SidebarGroup>
          <div className="flex items-center justify-center gap-[10px]">
            <img src="#" alt="foto de perfil" />
            <div className="flex flex-col">
              <span>Nome do perfil</span>
              <select name="#" id="perfil">
                <option defaultValue={"perfil"} selected>Ver Perfil</option>
              </select>
            </div>
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}