import InputSearch from "@/components/input-search";

export default function Hero() {
  return (
    <div>
      <div className="flex w-full flex-row items-center gap-4 justify-between">
        <div className="w-[700px]">
          <InputSearch/>
        </div>
        <div className="flex items-center justify-center">
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
        <div>Alertas</div>
        <div>Perfil</div>
      </div>

      <div className="flex flex-row">
        <div>Card de entrada</div>
        <div>metas do dia</div>
      </div>
    </div>
  )
}