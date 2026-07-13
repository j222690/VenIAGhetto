import { useEffect, useState } from "react";
import { TokenService } from "@/services/TokenService";

export function useTokens() {
  const [balance, setBalance] = useState(TokenService.balance());
  const [used, setUsed] = useState(TokenService.usedThisMonth());

  useEffect(() => {
    const sync = () => {
      setBalance(TokenService.balance());
      setUsed(TokenService.usedThisMonth());
    };
    sync();
    return TokenService.subscribe(sync);
  }, []);

  const total = balance + used;
  const lowBalance = total > 0 && balance / total < 0.2;

  return { balance, used, total, lowBalance };
}
