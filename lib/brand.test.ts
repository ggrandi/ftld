import { Brand } from "./brand";
import { Result } from "./result";

declare const IntTypeId: unique symbol;

describe.concurrent("Brand", () => {
  it("nominal", () => {
    const Int = Brand<Int>();
    expect(Int(1)).toEqual(1);
  });

  type Int = Brand<number, typeof IntTypeId>;
  const Int = Brand<Int>({
    validate: (n) => Number.isInteger(n),
    onErr: (n) => Brand.Error(`Expected ${n} to be an integer`),
  });

  type Positive = Brand<number, "Positive">;
  const Positive = Brand<Positive>({
    validate: (n) => n > 0,
    onErr: (n) => Brand.Error(`Expected ${n} to be positive`),
  });

  type PositiveInt = Positive & Int;
  const PositiveInt = Brand.compose(Int, Positive);

  it("refined", () => {
    expect(Int(1)).toEqual(Result.Ok(1));
    expect(Int(1.1)).toEqual(
      Result.Err(Brand.Error("Expected 1.1 to be an integer"))
    );
    expect(PositiveInt(1)).toEqual(Result.Ok(1));
    expect(PositiveInt(1.1)).toEqual(
      Result.Err([Brand.Error("Expected 1.1 to be an integer")])
    );
    expect(PositiveInt(-1.1)).toEqual(
      Result.Err([
        Brand.Error("Expected -1.1 to be an integer"),
        Brand.Error("Expected -1.1 to be positive"),
      ])
    );
  });
});
