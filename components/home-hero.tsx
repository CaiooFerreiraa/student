import InputSearch from "@/components/input-search";

export default function Hero() {
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
          <div>
            <span className="material-symbols-outlined !text-[36px]">
              notifications
            </span>
            <span>
              1
            </span>
          </div>
          <div>
            <img src="#" alt="Foto de Perfil" />
          </div>
        </div>
      </div>

      <div className="flex flex-row">
        <div>Card de entrada</div>
        <div>metas do dia</div>
      </div>
    </div>
  )
}