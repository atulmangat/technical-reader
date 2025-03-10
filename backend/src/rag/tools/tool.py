from typing import Callable

# Interface for tools


class Tool:
    def __init__(self, name: str, description: str, function: Callable):
        self.name = name
        self.description = description
        self.function = function

    def execute(self, *args, **kwargs):
        return self.function(*args, **kwargs)
