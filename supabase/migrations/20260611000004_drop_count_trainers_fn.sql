-- count_trainers_in_window (criada na 20260611000002) ficou órfã: a página passou
-- a usar validation_activation, que já devolve new_trainers. Removendo para não
-- deixar função sem uso exposta ao anon.

drop function if exists count_trainers_in_window(int);
