import InputSearch from "@/components/input-search";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function Hero() {
  const name: string = "Caio"

  return (
    <div>
      <div className="flex w-full flex-row items-center gap-4 justify-between">
        <div className="w-[700px]">
          <InputSearch/>
        </div>
        <div className="flex flex-row items-center gap-10">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined !text-[48px] !bg-gradient-to-r from-red-500 to-orange-600 bg-clip-text text-transparent">
              local_fire_department
            </span>
            <div className="flex flex-col">
              <span>
                12
              </span>
              <span>
                Dias de sequência
              </span>
            </div>
          </div>
          <div className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-muted">
            <span className="material-symbols-outlined !text-[36px]">
              notifications
            </span>
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 size-2.5 rounded-full bg-red-500 ring-2 ring-background"
            />
          </div>
          <div>
            <Image src="/robozinho-student.png" width={44} height={44} alt="Foto de Perfil" />
          </div>
        </div>
      </div>

      <div className="flex flex-row justify-between my-5">
        <div className="w-[60%] flex flex-row relative">
          <div className="flex flex-col">
            <span>Olá, {name}</span>
            <span>Pronto para mais umas sessão de estudos produtivos?</span>
            <span>Continue sua jornada e conquiste seus objetivos</span>
            <div>
              <Button className="bg-[blue] hover:bg-blue-500 cursor-pointer">Continuar estudando <span>icon</span></Button>
              <Button className="bg-[blue] hover:bg-blue-500 cursor-pointer">Ver meu desempenho<span>icon</span></Button>
            </div>
          </div>
          <div className="absolute right-40">
            Imagem do robo
          </div>
        </div>
        <div className="w-[40%]">
          <div>
            <span>Metas de hoje</span>
            <a href="#">Ver todas</a>
          </div>
          <span>
            <span>icon</span>
            <span>
              texto
              <span>barra</span>              
            </span>
          </span>
          <span>
            <span>icon</span>
            <span>
              texto
              <span>barra</span>
            </span>
          </span>
          <span>
            <span>icon</span>
            <span>
              texto
              <span>barra</span>              
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
