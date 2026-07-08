import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function InputSearch() {
  return (
    <div>
      <Field orientation={"horizontal"}>
        <Input type="search" placeholder="Search..."></Input>
        <Button className="cursor-pointer">Search</Button>
      </Field>
    </div>
  )
}